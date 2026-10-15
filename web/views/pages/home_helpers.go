package pages

import (
	"github.com/a-h/templ"
	"strconv"
	"workshop/internal/domain/sighting"
	"workshop/web/views/components"
)

// leadThumb is a small version of a sighting's first photo, or "".
func leadThumb(s sighting.Sighting) string {
	if img, ok := components.LeadImage(s); ok {
		return components.Sized(img.URL, "small")
	}
	return ""
}

// tugWidth sizes one side of a shared animal's tug of war by its count.
func tugWidth(n int) templ.SafeCSS {
	return templ.SafeCSS("flex-grow:" + strconv.Itoa(n))
}

// barWidth sizes a face-off bar as a share of the side's top count.
func barWidth(n, top int) templ.SafeCSS {
	return templ.SafeCSS("width:" + components.Percent(n, top))
}
