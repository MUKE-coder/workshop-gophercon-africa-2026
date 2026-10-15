package handlers

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"slices"
	"uuid"
	"workshop/internal/domain/sighting"
	"workshop/web/views/pages"
)

// SightingReader finds one sighting and lists others.
type SightingReader interface {
	SightingsLister
	Find(ctx context.Context, id uuid.UUID) (sighting.Sighting, error)
}

// Sighting renders the page for one sighting, at /sightings/{id}.
func Sighting(logger *slog.Logger, sightings SightingReader) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		id, err := uuid.Parse(r.PathValue("id"))
		if err != nil {
			renderError(ctx, w, logger, http.StatusNotFound, "That link doesn't point to a sighting. Check it, or go back to the list.")
			return
		}

		s, err := sightings.Find(ctx, id)
		if errors.Is(err, sighting.ErrNotFound) {
			renderError(ctx, w, logger, http.StatusNotFound, "We couldn't find that sighting. It may have been removed.")
			return
		}
		if err != nil {
			logger.ErrorContext(ctx, "handlers: finding sighting: "+err.Error())
			renderError(ctx, w, logger, http.StatusInternalServerError, "We couldn't load that sighting. Try again in a moment.")
			return
		}

		var nearby []sighting.Sighting
		if s.Location.CountryCode != "" {
			// One more than shown, in case this sighting is among them.
			nearby, err = sightings.List(ctx, sighting.ListFilter{Country: s.Location.CountryCode, Limit: 5})
			if err != nil {
				logger.WarnContext(ctx, "handlers: listing nearby sightings: "+err.Error())
			}
			nearby = slices.DeleteFunc(nearby, func(n sighting.Sighting) bool { return n.ID == s.ID })
			nearby = nearby[:min(4, len(nearby))]
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		if err = pages.Sighting(pages.SightingData{Sighting: s, Nearby: nearby}).Render(ctx, w); err != nil {
			logger.ErrorContext(ctx, "handlers: rendering sighting: "+err.Error())
		}
	}
}
