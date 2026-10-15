package pages

import (
	"workshop/internal/domain/sighting"
	"workshop/web/views/components"
)

// Option is one choice in a filter dropdown.
type Option struct {
	Value string
	Label string
	// Count is how many sightings the option has, where that's useful.
	Count int
}

// Filter is the home page's filter form, as the visitor last submitted it.
type Filter struct {
	Animal  string
	Country string
	From    string
	To      string
}

// Active reports whether any filter is set.
func (f Filter) Active() bool {
	return f.Animal != "" || f.Country != "" || f.From != "" || f.To != ""
}

// HomeData is everything the home page shows.
type HomeData struct {
	// Sightings is the page of results to show on the wall.
	Sightings []sighting.Sighting
	// Matched is how many sightings match the filter, beyond this page.
	Matched int
	// Featured are a few photogenic sightings for the hero slideshow.
	Featured []sighting.Sighting
	// Summary covers every sighting, not only the filtered ones.
	Summary   sighting.Summary
	Points    []components.Point
	Filter    Filter
	Animals   []Option
	Countries []Option
	// MoreURL loads a longer page of results; empty when all are shown.
	MoreURL string
	// Recent are the newest few sightings, for the hero's floating cards.
	Recent  []sighting.Sighting
	Compare Compare
}

// Compare is the two-country face-off.
type Compare struct {
	A, B Side
	// Shared are the animals seen in both countries, by name.
	Shared []SharedAnimal
	// Rounds are the head-to-head contests that decide the winner.
	Rounds []Round
	// Winner is "a", "b", or "" for a draw.
	Winner string
	WinsA  int
	WinsB  int
}

// WinnerName is the winning country's name, or "" for a draw.
func (c Compare) WinnerName() string {
	switch c.Winner {
	case "a":
		return c.A.Name
	case "b":
		return c.B.Name
	}
	return ""
}

// Round is one contest in the face-off, such as most species.
type Round struct {
	Name   string
	A, B   int
	Winner string
}

// SharedAnimal is an animal seen in both countries, with each side's tally.
type SharedAnimal struct {
	Name string
	A, B Animal
}

// Photo is the best photo of the animal from either side.
func (s SharedAnimal) Photo() string {
	if s.A.Photo != "" {
		return s.A.Photo
	}
	return s.B.Photo
}

// Side is one country in the face-off.
type Side struct {
	Code      string
	Name      string
	Sightings int
	Species   int
	Photos    int
	// Unique is how many animals were seen here and not in the other country.
	Unique int
	// Animals are the country's most-seen animals, most first.
	Animals []Animal
}

// Animal is one row in a side of the face-off.
type Animal struct {
	Name  string
	Count int
	Img   string
	// Photo is a larger version of Img.
	Photo  string
	Link   string
	Shared bool
}

// SightingData is everything a single sighting's page shows.
type SightingData struct {
	Sighting sighting.Sighting
	// Nearby are other sightings in the same country.
	Nearby []sighting.Sighting
}

// MapData is every sighting with a position.
type MapData struct {
	Points  []components.Point
	Summary sighting.Summary
}

// StatsData is the numbers page.
type StatsData struct {
	Summary    sighting.Summary
	Species    []sighting.Tally
	Countries  []sighting.Tally
	Conditions []sighting.Tally
	Decades    []sighting.Tally
	// Recent is the newest sightings, for the "latest" strip.
	Recent []sighting.Sighting
}

// MaxCount is the largest count in a tally, for scaling bars.
func MaxCount(rows []sighting.Tally) int {
	m := 0
	for _, r := range rows {
		m = max(m, r.Count)
	}
	return m
}

// Exhibit is one enclosure in the 3D zoo.
type Exhibit struct {
	Key          string         `json:"key"`
	Title        string         `json:"title"`
	Script       string         `json:"script"`
	Animal       string         `json:"animal"`
	Kind         string         `json:"kind"`
	Ground       string         `json:"ground"`
	Scientific   string         `json:"scientific"`
	Fact         string         `json:"-"`
	Sightings    int            `json:"-"`
	Countries    int            `json:"-"`
	TopCountries []string       `json:"-"`
	Photos       []ExhibitPhoto `json:"photos"`
}

// ExhibitPhoto is a real sighting photo shown at an enclosure.
type ExhibitPhoto struct {
	Img  string `json:"img"`
	Link string `json:"-"`
	By   string `json:"-"`
	// Board is true when the photo's host allows it on a board in the scene.
	Board bool `json:"board"`
}
