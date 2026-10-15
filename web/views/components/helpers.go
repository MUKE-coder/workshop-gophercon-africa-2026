package components

import (
	"cmp"
	"fmt"
	"slices"
	"strings"

	"workshop/internal/domain/sighting"
	"workshop/internal/domain/species"
	"workshop/internal/domain/weather"
)

// DisplayName prefers the name a reader would recognise, falling back
// through the taxonomy as GBIF records thin out.
func DisplayName(sp species.Species) string {
	name := cmp.Or(sp.VernacularName, sp.CanonicalName, sp.ScientificName, "Unknown species")
	return upperFirst(name)
}

// Place joins whichever parts of the location GBIF supplied.
func Place(l sighting.Location) string {
	parts := slices.DeleteFunc(
		[]string{l.Locality, l.StateProvince, l.Country},
		func(s string) bool { return s == "" },
	)
	return cmp.Or(strings.Join(parts, ", "), "Location unknown")
}

// ShortPlace is the broadest two parts of the location, for tight spaces.
func ShortPlace(l sighting.Location) string {
	parts := slices.DeleteFunc(
		[]string{l.StateProvince, l.Country},
		func(s string) bool { return s == "" },
	)
	return cmp.Or(strings.Join(parts, ", "), l.Locality, "Location unknown")
}

// Individuals renders how many animals were seen in a single sighting.
func Individuals(n int) string {
	if n == 1 {
		return "1 individual"
	}
	return fmt.Sprintf("%d individuals", n)
}

// AnimalLabel turns an animal such as "african_wild_dog" into "African wild dog".
func AnimalLabel(a species.Animal) string {
	return upperFirst(strings.ReplaceAll(a.String(), "_", " "))
}

// Images returns the still images of a sighting, in the order recorded.
func Images(media []sighting.Media) []sighting.Media {
	return slices.DeleteFunc(slices.Clone(media), func(m sighting.Media) bool {
		return m.Type != "StillImage" || m.URL == ""
	})
}

// LeadImage is the first still image of a sighting, if it has one.
func LeadImage(s sighting.Sighting) (sighting.Media, bool) {
	imgs := Images(s.Media)
	if len(imgs) == 0 {
		return sighting.Media{}, false
	}
	return imgs[0], true
}

// Sized asks image hosts that offer smaller renditions for one, so a wall
// of photos doesn't download every original. size is "small", "medium"
// or "large"; hosts that don't resize are returned unchanged.
func Sized(url, size string) string {
	if strings.Contains(url, "inaturalist-open-data") || strings.Contains(url, "static.inaturalist.org") {
		for _, from := range []string{"/original.", "/large.", "/medium.", "/small."} {
			if strings.Contains(url, from) {
				return strings.Replace(url, from, "/"+size+".", 1)
			}
		}
	}
	return url
}

// AltText describes an image for screen readers.
func AltText(m sighting.Media, fallback string) string {
	return cmp.Or(m.Title, m.Description, fallback)
}

// HasWeather reports whether the sighting came with a weather reading.
func HasWeather(w weather.Weather) bool {
	return !w.ObservedAt.IsZero()
}

// WeatherIcon maps a WMO weather code to an emoji.
func WeatherIcon(code int) string {
	switch {
	case code == 0:
		return "☀️"
	case code <= 2:
		return "🌤️"
	case code == 3:
		return "☁️"
	case code <= 48:
		return "🌫️"
	case code <= 67:
		return "🌧️"
	case code <= 77:
		return "❄️"
	case code <= 82:
		return "🌦️"
	case code <= 86:
		return "🌨️"
	default:
		return "⛈️"
	}
}

// WeatherLine is a short sentence about the weather at a sighting.
func WeatherLine(w weather.Weather) string {
	desc := strings.ToLower(cmp.Or(w.Condition.Description, "unknown sky"))
	return fmt.Sprintf("%.0f°C, %s", w.Temperature.Actual, desc)
}

// Compass turns a wind direction in degrees into a compass point.
func Compass(deg int) string {
	points := []string{"N", "NE", "E", "SE", "S", "SW", "W", "NW"}
	return points[((deg%360)+360+22)%360/45]
}

// Accent picks one of the kanga colours for a name, so the same species
// always gets the same colour.
func Accent(name string) string {
	accents := []string{"marigold", "hibiscus", "leaf", "lagoon"}
	var h int
	for _, r := range name {
		h = h*31 + int(r)
	}
	if h < 0 {
		h = -h
	}
	return accents[h%len(accents)]
}

// Percent is n as a share of max, for sizing bars.
func Percent(n, max int) string {
	if max == 0 {
		return "0%"
	}
	return fmt.Sprintf("%.1f%%", float64(n)/float64(max)*100)
}

func upperFirst(s string) string {
	if s == "" {
		return s
	}
	r := []rune(s)
	return strings.ToUpper(string(r[0])) + string(r[1:])
}

// Point is a sighting reduced to what a map or globe needs.
type Point struct {
	ID    string  `json:"id"`
	Name  string  `json:"name"`
	Place string  `json:"place"`
	Date  string  `json:"date"`
	Lat   float64 `json:"lat"`
	Lng   float64 `json:"lng"`
	Img   string  `json:"img,omitempty"`
	Hue   string  `json:"hue"`
}

// Points turns sightings into map points, skipping any without a position.
func Points(sightings []sighting.Sighting) []Point {
	out := make([]Point, 0, len(sightings))
	for _, s := range sightings {
		if s.Location.Latitude == 0 && s.Location.Longitude == 0 {
			continue
		}
		name := DisplayName(s.Species)
		p := Point{
			ID:    s.ID.String(),
			Name:  name,
			Place: ShortPlace(s.Location),
			Date:  s.HappenedAt.Format("2 Jan 2006"),
			Lat:   s.Location.Latitude,
			Lng:   s.Location.Longitude,
			Hue:   Accent(name),
		}
		if img, ok := LeadImage(s); ok {
			p.Img = Sized(img.URL, "small")
		}
		out = append(out, p)
	}
	return out
}
