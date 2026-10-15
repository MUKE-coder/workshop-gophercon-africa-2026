package handlers

import (
	"cmp"
	"slices"
	"strings"
	"workshop/internal/domain/sighting"
	"workshop/web/views/components"
	"workshop/web/views/pages"
)

// compareTop is how many animals each side of the face-off lists.
const compareTop = 8

// compare builds the two-country face-off from every sighting. Missing or
// unknown codes fall back to Kenya and South Africa, then to the two
// countries with the most sightings.
func compare(all []sighting.Sighting, a, b string) pages.Compare {
	byCountry := make(map[string][]sighting.Sighting)
	for _, s := range all {
		if code := s.Location.CountryCode.String(); code != "" {
			byCountry[code] = append(byCountry[code], s)
		}
	}

	a, b = strings.ToUpper(strings.TrimSpace(a)), strings.ToUpper(strings.TrimSpace(b))
	defaults := append([]string{"KE", "ZA"}, busiest(byCountry)...)
	pick := func(code, avoid string) string {
		if _, ok := byCountry[code]; ok {
			return code
		}
		for _, d := range defaults {
			if _, ok := byCountry[d]; ok && d != avoid {
				return d
			}
		}
		return ""
	}
	a = pick(a, b)
	b = pick(b, a)

	left, inA := side(a, byCountry[a])
	right, inB := side(b, byCountry[b])

	var shared []pages.SharedAnimal
	for n, an := range inA {
		if bn, ok := inB[n]; ok {
			shared = append(shared, pages.SharedAnimal{Name: n, A: an, B: bn})
		}
	}
	slices.SortFunc(shared, func(x, y pages.SharedAnimal) int { return cmp.Compare(x.Name, y.Name) })

	for i := range left.Animals {
		_, left.Animals[i].Shared = inB[left.Animals[i].Name]
	}
	for i := range right.Animals {
		_, right.Animals[i].Shared = inA[right.Animals[i].Name]
	}
	left.Unique = len(inA) - len(shared)
	right.Unique = len(inB) - len(shared)

	c := pages.Compare{A: left, B: right, Shared: shared}
	judge(&c)
	return c
}

// judge plays the rounds and names a winner: most rounds won, then most
// species, then most sightings. Anything left level is a draw.
func judge(c *pages.Compare) {
	if c.A.Code == "" || c.B.Code == "" {
		return
	}
	c.Rounds = []pages.Round{
		{Name: "Most species", A: c.A.Species, B: c.B.Species},
		{Name: "Most sightings", A: c.A.Sightings, B: c.B.Sightings},
		{Name: "Animals found only here", A: c.A.Unique, B: c.B.Unique},
		{Name: "Most photos", A: c.A.Photos, B: c.B.Photos},
	}
	for i, r := range c.Rounds {
		switch {
		case r.A > r.B:
			c.Rounds[i].Winner = "a"
			c.WinsA++
		case r.B > r.A:
			c.Rounds[i].Winner = "b"
			c.WinsB++
		}
	}

	switch {
	case c.WinsA != c.WinsB:
		c.Winner = pickSide(c.WinsA > c.WinsB)
	case c.A.Species != c.B.Species:
		c.Winner = pickSide(c.A.Species > c.B.Species)
	case c.A.Sightings != c.B.Sightings:
		c.Winner = pickSide(c.A.Sightings > c.B.Sightings)
	}
}

func pickSide(a bool) string {
	if a {
		return "a"
	}
	return "b"
}

// side tallies one country's sightings by animal, keeping a photo of each.
// It also returns every animal by name, beyond the top few the side lists.
func side(code string, rows []sighting.Sighting) (pages.Side, map[string]pages.Animal) {
	s := pages.Side{Code: code, Sightings: len(rows)}
	if len(rows) > 0 {
		s.Name = rows[0].Location.Country
	}

	animals := make(map[string]*pages.Animal)
	for _, r := range rows {
		name := components.DisplayName(r.Species)
		an, ok := animals[name]
		if !ok {
			an = &pages.Animal{Name: name, Link: "/sightings/" + r.ID.String()}
			animals[name] = an
		}
		an.Count++
		s.Photos += len(components.Images(r.Media))
		if img, ok := components.LeadImage(r); ok && an.Img == "" {
			an.Img = components.Sized(img.URL, "small")
			an.Photo = components.Sized(img.URL, "medium")
		}
	}
	s.Species = len(animals)

	all := make(map[string]pages.Animal, len(animals))
	for name, an := range animals {
		s.Animals = append(s.Animals, *an)
		all[name] = *an
	}
	slices.SortFunc(s.Animals, func(x, y pages.Animal) int {
		return cmp.Or(cmp.Compare(y.Count, x.Count), cmp.Compare(x.Name, y.Name))
	})
	s.Animals = s.Animals[:min(compareTop, len(s.Animals))]

	return s, all
}

// busiest lists country codes, most sightings first.
func busiest(byCountry map[string][]sighting.Sighting) []string {
	codes := make([]string, 0, len(byCountry))
	for c := range byCountry {
		codes = append(codes, c)
	}
	slices.SortFunc(codes, func(x, y string) int {
		return cmp.Or(cmp.Compare(len(byCountry[y]), len(byCountry[x])), cmp.Compare(x, y))
	})
	return codes
}
