package handlers

import (
	"cmp"
	"log/slog"
	"net/http"
	"slices"
	"strconv"
	"workshop/internal/domain/sighting"
	"workshop/web/views/components"
	"workshop/web/views/pages"
)

// Map renders every sighting on a map.
func Map(logger *slog.Logger, sightings SightingsLister) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		all, err := sightings.List(ctx, sighting.ListFilter{})
		if err != nil {
			logger.ErrorContext(ctx, "handlers: listing sightings for map: "+err.Error())
			renderError(ctx, w, logger, http.StatusInternalServerError, "We couldn't load the map. Try again in a moment.")
			return
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		data := pages.MapData{Points: components.Points(all), Summary: sighting.Summarise(all)}
		if err = pages.Map(data).Render(ctx, w); err != nil {
			logger.ErrorContext(ctx, "handlers: rendering map: "+err.Error())
		}
	}
}

// Stats renders the numbers page.
func Stats(logger *slog.Logger, sightings SightingsLister) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		all, err := sightings.List(ctx, sighting.ListFilter{})
		if err != nil {
			logger.ErrorContext(ctx, "handlers: listing sightings for stats: "+err.Error())
			renderError(ctx, w, logger, http.StatusInternalServerError, "We couldn't work out the numbers. Try again in a moment.")
			return
		}

		data := pages.StatsData{
			Summary: sighting.Summarise(all),
			Species: sighting.Top(sighting.CountBy(all, func(s sighting.Sighting) string {
				return components.DisplayName(s.Species)
			}), 10),
			Countries: sighting.Top(sighting.CountBy(all, func(s sighting.Sighting) string {
				return s.Location.Country
			}), 10),
			Conditions: sighting.Top(sighting.CountBy(all, func(s sighting.Sighting) string {
				if !components.HasWeather(s.Weather) {
					return ""
				}
				return s.Weather.Condition.Description
			}), 8),
			Decades: decades(all),
			Recent:  all[:min(4, len(all))],
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		if err = pages.Stats(data).Render(ctx, w); err != nil {
			logger.ErrorContext(ctx, "handlers: rendering stats: "+err.Error())
		}
	}
}

// NotFound renders the 404 page for any path no other route matches.
func NotFound(logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		renderError(r.Context(), w, logger, http.StatusNotFound, "There's no page at "+r.URL.Path+". It may have moved, or the link may be wrong.")
	}
}

// decades counts sightings per decade, oldest first, including empty ones
// in between so the timeline keeps its shape.
func decades(all []sighting.Sighting) []sighting.Tally {
	byYear := sighting.CountByYear(all)
	if len(byYear) == 0 {
		return nil
	}

	counts := make(map[int]int)
	for year, n := range byYear {
		counts[year/10*10] += n
	}
	keys := slices.Sorted(func(yield func(int) bool) {
		for k := range counts {
			if !yield(k) {
				return
			}
		}
	})

	first, last := keys[0], keys[len(keys)-1]
	out := make([]sighting.Tally, 0, (last-first)/10+1)
	for d := first; d <= last; d += 10 {
		out = append(out, sighting.Tally{Name: strconv.Itoa(d) + "s", Count: counts[d]})
	}
	slices.SortStableFunc(out, func(a, b sighting.Tally) int { return cmp.Compare(a.Name, b.Name) })
	return out
}
