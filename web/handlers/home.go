package handlers

import (
	"cmp"
	"context"
	"log/slog"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"time"
	"workshop/internal/domain/sighting"
	"workshop/internal/domain/sighting/country"
	"workshop/internal/domain/species"
	"workshop/web/views/components"
	"workshop/web/views/pages"
)

type SightingsLister interface {
	List(ctx context.Context, filter sighting.ListFilter) ([]sighting.Sighting, error)
}

const (
	// pageSize is how many sightings the wall shows before "Show more".
	pageSize = 24
	// maxShow caps how far "Show more" can go in one page.
	maxShow = 500
)

func Home(logger *slog.Logger, sightings SightingsLister) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		q := r.URL.Query()

		filter, form := parseFilter(q)

		// Every sighting feeds the globe, the headline numbers and the
		// country dropdown, whatever the visitor has filtered by.
		all, err := sightings.List(ctx, sighting.ListFilter{})
		if err != nil {
			logger.ErrorContext(ctx, "handlers: listing sightings: "+err.Error())
			renderError(ctx, w, logger, http.StatusInternalServerError, "We couldn't load the sightings. Try again in a moment.")
			return
		}

		matched := all
		if form.Active() {
			matched, err = sightings.List(ctx, filter)
			if err != nil {
				logger.ErrorContext(ctx, "handlers: filtering sightings: "+err.Error())
				renderError(ctx, w, logger, http.StatusInternalServerError, "We couldn't search the sightings. Try again in a moment.")
				return
			}
		}

		show := pageSize
		if n, err := strconv.Atoi(q.Get("show")); err == nil && n > 0 {
			show = min(n, maxShow)
		}

		data := pages.HomeData{
			Sightings: matched[:min(show, len(matched))],
			Featured:  featured(all, 5),
			Recent:    featured(all, 3),
			Compare:   compare(all, q.Get("a"), q.Get("b")),
			Matched:   len(matched),
			Summary:   sighting.Summarise(all),
			Points:    components.Points(all),
			Filter:    form,
			Animals:   animalOptions(),
			Countries: countryOptions(all),
		}
		if show < len(matched) && show < maxShow {
			next := cloneValues(q)
			next.Set("show", strconv.Itoa(show+pageSize))
			data.MoreURL = "/?" + next.Encode() + "#sightings"
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		if err = pages.Home(data).Render(ctx, w); err != nil {
			logger.ErrorContext(ctx, "handlers: rendering sightings: "+err.Error())
			renderError(ctx, w, logger, http.StatusInternalServerError, "Unable to render page.")
		}
	}
}

// parseFilter reads the filter form from the query string. A value that
// doesn't parse is dropped rather than failing the page, so a hand-edited
// URL still shows something.
func parseFilter(q url.Values) (sighting.ListFilter, pages.Filter) {
	var (
		filter sighting.ListFilter
		form   pages.Filter
	)

	if a, err := species.ParseAnimal(q.Get("animal")); err == nil {
		filter.Animals = []species.Animal{a}
		form.Animal = a.String()
	}
	if c, err := country.Parse(q.Get("country")); err == nil && c != "" {
		filter.Country = c
		form.Country = c.String()
	}
	if t, err := time.Parse(time.DateOnly, q.Get("from")); err == nil {
		filter.FromDate = &t
		form.From = t.Format(time.DateOnly)
	}
	if t, err := time.Parse(time.DateOnly, q.Get("to")); err == nil {
		// Include the whole of the last day.
		end := t.Add(24*time.Hour - time.Nanosecond)
		filter.ToDate = &end
		form.To = t.Format(time.DateOnly)
	}

	return filter, form
}

// featured picks the newest sighting with a photo for each of up to n
// different species, so the hero slideshow doesn't show one animal twice.
func featured(all []sighting.Sighting, n int) []sighting.Sighting {
	seen := make(map[string]bool)
	var out []sighting.Sighting
	for _, s := range all {
		if len(out) == n {
			break
		}
		name := components.DisplayName(s.Species)
		if _, ok := components.LeadImage(s); !ok || seen[name] {
			continue
		}
		seen[name] = true
		out = append(out, s)
	}
	return out
}

func animalOptions() []pages.Option {
	animals := species.Animals()
	out := make([]pages.Option, 0, len(animals))
	for _, a := range animals {
		out = append(out, pages.Option{Value: a.String(), Label: components.AnimalLabel(a)})
	}
	return out
}

// countryOptions lists the countries that have at least one sighting.
func countryOptions(all []sighting.Sighting) []pages.Option {
	seen := make(map[string]string)
	counts := make(map[string]int)
	for _, s := range all {
		if code := s.Location.CountryCode.String(); code != "" {
			seen[code] = cmp.Or(s.Location.Country, code)
			counts[code]++
		}
	}
	out := make([]pages.Option, 0, len(seen))
	for code, name := range seen {
		out = append(out, pages.Option{Value: code, Label: name, Count: counts[code]})
	}
	slices.SortFunc(out, func(a, b pages.Option) int { return cmp.Compare(a.Label, b.Label) })
	return out
}

func cloneValues(v url.Values) url.Values {
	out := make(url.Values, len(v))
	for k, vs := range v {
		out[k] = slices.Clone(vs)
	}
	return out
}
