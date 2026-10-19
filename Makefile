UUID = auto-activities@zonaston.github.io
INSTALLBASE ?= $(if $(DESTDIR),$(DESTDIR)/usr/share,$(HOME)/.local/share)/gnome-shell/extensions
EXTENSION_FILES = extension.js autoActivities.js metadata.json prefs.js prefs.ui LICENSE

.PHONY: default build pack install uninstall clean test
default: build

build:
	glib-compile-schemas --strict ./schemas

pack: build
	mkdir -p dist
	gnome-extensions pack --force --out-dir=dist --extra-source=autoActivities.js --extra-source=prefs.ui --extra-source=LICENSE .

install: build
	mkdir -p "$(INSTALLBASE)/$(UUID)/schemas"
	install -m 644 $(EXTENSION_FILES) "$(INSTALLBASE)/$(UUID)/"
	install -m 644 schemas/*.xml schemas/gschemas.compiled "$(INSTALLBASE)/$(UUID)/schemas/"

uninstall:
	rm -rf "$(INSTALLBASE)/$(UUID)"

clean:
	rm -f ./schemas/gschemas.compiled
	rm -rf dist

test:
	gjs -m tests/manager.js
