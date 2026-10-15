package handlers_test

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
	"uuid"
	"workshop/internal/common/logs"
	"workshop/internal/domain/sighting"
	"workshop/internal/domain/sighting/country"
	"workshop/internal/domain/species"
	"workshop/web/handlers"

	"github.com/stretchr/testify/assert"
)

func TestSighting(t *testing.T) {
	t.Parallel()

	id := uuid.New()
	found := sighting.Sighting{
		ID:         id,
		HappenedAt: time.Date(2026, 9, 12, 0, 0, 0, 0, time.UTC),
		Species:    species.Species{VernacularName: "lion"},
		Location:   sighting.Location{Country: "Kenya", CountryCode: "KE"},
	}

	tt := map[string]struct {
		path   string
		reader fakeReader
		want   int
	}{
		"OK":        {path: "/sightings/" + id.String(), reader: fakeReader{found: found}, want: http.StatusOK},
		"Bad ID":    {path: "/sightings/not-a-uuid", reader: fakeReader{}, want: http.StatusNotFound},
		"Not found": {path: "/sightings/" + id.String(), reader: fakeReader{findErr: sighting.ErrNotFound}, want: http.StatusNotFound},
		"Store error": {
			path:   "/sightings/" + id.String(),
			reader: fakeReader{findErr: errors.New("store unavailable")},
			want:   http.StatusInternalServerError,
		},
	}

	for name, test := range tt {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			mux := http.NewServeMux()
			mux.Handle("GET /sightings/{id}", handlers.Sighting(discard(), test.reader))
			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, test.path, nil))

			assert.Equal(t, test.want, rec.Code)
		})
	}
}

func TestMapAndStats(t *testing.T) {
	t.Parallel()

	items := []sighting.Sighting{
		{
			ID:         uuid.New(),
			HappenedAt: time.Date(2024, 1, 2, 0, 0, 0, 0, time.UTC),
			Species:    species.Species{VernacularName: "lion"},
			Location: sighting.Location{
				Country:     "Kenya",
				Coordinates: sighting.Coordinates{Latitude: -1.29, Longitude: 36.86},
			},
		},
	}

	for name, h := range map[string]func(*slog.Logger, handlers.SightingsLister) http.HandlerFunc{
		"Map":   handlers.Map,
		"Stats": handlers.Stats,
	} {
		t.Run(name+" OK", func(t *testing.T) {
			t.Parallel()

			rec := httptest.NewRecorder()
			h(discard(), fakeLister{items: items})(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", nil))
			assert.Equal(t, http.StatusOK, rec.Code)
		})

		t.Run(name+" list error", func(t *testing.T) {
			t.Parallel()

			rec := httptest.NewRecorder()
			h(discard(), fakeLister{err: errors.New("boom")})(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", nil))
			assert.Equal(t, http.StatusInternalServerError, rec.Code)
		})
	}
}

func TestHome_Filters(t *testing.T) {
	t.Parallel()

	var got sighting.ListFilter
	lister := recordingLister{record: func(f sighting.ListFilter) { got = f }}

	rec := httptest.NewRecorder()
	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/?animal=leopard&country=ke&from=2025-01-01&to=bad", nil)
	handlers.Home(discard(), lister)(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, []species.Animal{species.AnimalLeopard}, got.Animals)
	assert.Equal(t, "KE", got.Country.String())
	if assert.NotNil(t, got.FromDate) {
		assert.Equal(t, "2025-01-01", got.FromDate.Format(time.DateOnly))
	}
	assert.Nil(t, got.ToDate, "an unparseable date is dropped")
}

func TestNotFound(t *testing.T) {
	t.Parallel()

	rec := httptest.NewRecorder()
	handlers.NotFound(discard())(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/nope", nil))
	assert.Equal(t, http.StatusNotFound, rec.Code)
}

type fakeReader struct {
	found   sighting.Sighting
	findErr error
}

func (f fakeReader) Find(context.Context, uuid.UUID) (sighting.Sighting, error) {
	return f.found, f.findErr
}

func (f fakeReader) List(context.Context, sighting.ListFilter) ([]sighting.Sighting, error) {
	return nil, nil
}

// recordingLister hands the last non-empty filter it was given to record.
type recordingLister struct {
	record func(sighting.ListFilter)
}

func (r recordingLister) List(_ context.Context, f sighting.ListFilter) ([]sighting.Sighting, error) {
	if len(f.Animals) > 0 || f.Country != "" || f.FromDate != nil || f.ToDate != nil {
		r.record(f)
	}
	return nil, nil
}

func discard() *slog.Logger {
	return logs.NewProduction(io.Discard, slog.LevelError)
}

func TestHome_Compare(t *testing.T) {
	t.Parallel()

	seen := func(name, code, country string) sighting.Sighting {
		return sighting.Sighting{
			ID:       uuid.New(),
			Species:  species.Species{VernacularName: name},
			Location: sighting.Location{Country: country, CountryCode: country2(code)},
		}
	}
	items := []sighting.Sighting{
		seen("lion", "KE", "Kenya"),
		seen("hippo", "KE", "Kenya"),
		seen("lion", "ZA", "South Africa"),
		seen("penguin", "ZA", "South Africa"),
	}

	rec := httptest.NewRecorder()
	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/?a=KE&b=ZA", nil)
	handlers.Home(discard(), fakeLister{items: items})(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	body := rec.Body.String()
	assert.Contains(t, body, "animal in common")
	assert.Contains(t, body, `data-name="Lion" aria-expanded="false"`)
	assert.Contains(t, body, `See it in South Africa`)
}

func country2(code string) country.Code { return country.Code(code) }

func TestHome_CompareWinner(t *testing.T) {
	t.Parallel()

	seen := func(name, code, country string) sighting.Sighting {
		return sighting.Sighting{
			ID:       uuid.New(),
			Species:  species.Species{VernacularName: name},
			Location: sighting.Location{Country: country, CountryCode: country2(code)},
		}
	}

	tt := map[string]struct {
		items []sighting.Sighting
		want  string
	}{
		"Winner": {
			items: []sighting.Sighting{
				seen("lion", "KE", "Kenya"),
				seen("lion", "ZA", "South Africa"),
				seen("penguin", "ZA", "South Africa"),
			},
			want: "South Africa <em class=\"script\">wins!</em>",
		},
		"Draw": {
			items: []sighting.Sighting{
				seen("lion", "KE", "Kenya"),
				seen("lion", "ZA", "South Africa"),
			},
			want: "It's a <em class=\"script\">draw.</em>",
		},
	}

	for name, test := range tt {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			rec := httptest.NewRecorder()
			req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/?a=KE&b=ZA", nil)
			handlers.Home(discard(), fakeLister{items: test.items})(rec, req)

			assert.Equal(t, http.StatusOK, rec.Code)
			assert.Contains(t, rec.Body.String(), test.want)
		})
	}
}

func TestZoo(t *testing.T) {
	t.Parallel()

	t.Run("OK", func(t *testing.T) {
		t.Parallel()

		rec := httptest.NewRecorder()
		items := []sighting.Sighting{{ID: uuid.New(), Species: species.Species{VernacularName: "zebra"}, Location: sighting.Location{Country: "Kenya"}}}
		handlers.Zoo(discard(), fakeLister{items: items})(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/zoo", nil))

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), `data-panel="zebra"`)
		assert.Contains(t, rec.Body.String(), `id="zoo-data"`)
	})

	t.Run("List error", func(t *testing.T) {
		t.Parallel()

		rec := httptest.NewRecorder()
		handlers.Zoo(discard(), fakeLister{err: errors.New("boom")})(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/zoo", nil))

		assert.Equal(t, http.StatusInternalServerError, rec.Code)
	})
}
