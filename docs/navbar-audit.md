# Navbar Audit

## Files Related

* navbar.ejs
* navbar.css
* responsive.css

## Main Navbar Sections

* navbar-left
* navbar-center
* navbar-right

## Features Inside Navbar

* desktop tabs
* compact search pill
* destination dropdown
* guest panel
* user dropdown
* expanded search row

## JS Features

* scroll navbar state
* panel manager
* dropdown open/close
* guest counter
* global click handling

## Problems Found

* navbar too large
* many responsibilities in one file
* responsiveness may become difficult
* dropdown logic tightly connected

## Dangerous Areas

* absolute/floating panels
* active class toggling
* scroll-based navbar changes
* many DOM queries

## Future Cleanup Plan

* split navbar partials
* split navbar JS
* move navbar responsive rules into separate navbar-responsive.css


# Navbar CSS Audit

## Good Things

* CSS divided into sections
* clamp() used for responsive widths
* responsive breakpoints added
* z-index system exists
* comments added

## Risk Areas

* navbar handles too many features
* many absolute positioned panels
* many transform animations
* large z-index usage
* many responsive states

## Responsive Risks

* destination panels may overflow
* guest panel positioning sensitive
* landscape handling added separately
* compact search width changes many times

## JS + CSS Coupling

* active classes control visibility
* scrolled class changes navbar state
* panel behavior depends on JS

## Future Cleanup

* split destination panel css
* split guest panel css
* move responsive navbar rules into separate file
* reduce navbar responsibility
