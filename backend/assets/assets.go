// Package assets embeds static files bundled into the binary, such as the
// built-in default timesheet template.
package assets

import _ "embed"

// BNITemplate is the raw .xlsx bytes of the built-in "BNI DEV Timesheet"
// template, seeded as the default template on first boot.
//
//go:embed bni_dev_timesheet_template.xlsx
var BNITemplate []byte
