package handlers

import (
	"log/slog"
	"net/http"
	"strings"
	"workshop/internal/domain/sighting"
	"workshop/internal/domain/species"
	"workshop/web/views/components"
	"workshop/web/views/pages"
)

// enclosure describes one exhibit in the 3D zoo: which animal it shows and
// how the scene presents it.
type enclosure struct {
	key, title, script, animal string
	kind                       string // herd, lagoon, aviary or screen
	ground                     string // savanna, water, jungle or beach
	scientific                 string // for finding videos on Wikimedia Commons
	fact                       string
	filter                     species.Animal
}

var enclosures = []enclosure{
	{"zebra", "Savannah", "paddock", "Zebras", "herd", "savanna", "Equus quagga", "No two zebras have the same stripes. They're as unique as fingerprints.", species.AnimalZebra},
	{"flamingo", "Flamingo", "lagoon", "Greater flamingos", "lagoon", "water", "Phoenicopterus roseus", "Flamingos are pink because of the algae and tiny shrimp they eat.", species.AnimalGreaterFlamingo},
	{"macaw", "Rainforest", "aviary", "Scarlet macaws", "aviary", "jungle", "Ara macao", "Scarlet macaws pair for life and can live for 50 years or more.", species.AnimalScarletMacaw},
	{"lion", "Lion", "rock", "Lions", "screen", "savanna", "Panthera leo", "A lion's roar can be heard up to 8 km away.", species.AnimalLion},
	{"elephant", "Elephant", "valley", "Elephants", "screen", "savanna", "Loxodonta africana", "An elephant's trunk has around 40,000 muscles.", species.AnimalElephant},
	{"giraffe", "Giraffe", "heights", "Giraffes", "screen", "savanna", "Giraffa camelopardalis", "A giraffe's tongue can be about 50 cm long.", species.AnimalGiraffe},
	{"penguin", "Penguin", "beach", "African penguins", "screen", "beach", "Spheniscus demersus", "African penguins bray like donkeys to call to each other.", species.AnimalAfricanPenguin},
}

// Zoo renders the 3D zoo, one enclosure per animal, each filled from the
// sightings of that animal.
func Zoo(logger *slog.Logger, sightings SightingsLister) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		exhibits := make([]pages.Exhibit, 0, len(enclosures))
		for _, e := range enclosures {
			rows, err := sightings.List(ctx, sighting.ListFilter{Animals: []species.Animal{e.filter}})
			if err != nil {
				logger.ErrorContext(ctx, "handlers: listing sightings for zoo: "+err.Error())
				renderError(ctx, w, logger, http.StatusInternalServerError, "We couldn't open the zoo. Try again in a moment.")
				return
			}
			exhibits = append(exhibits, exhibit(e, rows))
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		if err := pages.Zoo(exhibits).Render(ctx, w); err != nil {
			logger.ErrorContext(ctx, "handlers: rendering zoo: "+err.Error())
		}
	}
}

func exhibit(e enclosure, rows []sighting.Sighting) pages.Exhibit {
	ex := pages.Exhibit{
		Key:        e.key,
		Title:      e.title,
		Script:     e.script,
		Animal:     e.animal,
		Kind:       e.kind,
		Ground:     e.ground,
		Scientific: e.scientific,
		Fact:       e.fact,
		Sightings:  len(rows),
		// Never nil, so the page's JSON has a list rather than null.
		Photos: []pages.ExhibitPhoto{},
	}

	countries := sighting.CountBy(rows, func(s sighting.Sighting) string { return s.Location.Country })
	ex.Countries = len(countries)
	for _, t := range sighting.Top(countries, 3) {
		ex.TopCountries = append(ex.TopCountries, t.Name)
	}

	for _, s := range rows {
		if len(ex.Photos) == 6 {
			break
		}
		img, ok := components.LeadImage(s)
		if !ok {
			continue
		}
		ex.Photos = append(ex.Photos, pages.ExhibitPhoto{
			Img:  components.Sized(img.URL, "medium"),
			Link: "/sightings/" + s.ID.String(),
			By:   s.RecordedBy,
			// Only some hosts let a 3D scene use their photos.
			Board: strings.Contains(img.URL, "inaturalist-open-data"),
		})
	}

	return ex
}
