.PHONY: help test test-e2e build check-bits publish

REMOTE_HOST := bits
REMOTE_PATH := /var/www/html/js/modern-boxplot
BUNDLE := dist/modern-boxplot.standalone.js
LIVE_URL := https://bits.featrix.com/js/modern-boxplot/modern-boxplot.standalone.js

help:
	@echo "Targets:"
	@echo "  make test       - run the Vitest unit suite"
	@echo "  make test-e2e   - run the Playwright e2e suite"
	@echo "  make build      - typecheck + build lib and standalone bundles"
	@echo "  make publish    - test, build, and rsync the standalone bundle to $(REMOTE_HOST)"

test:
	npm test

test-e2e:
	npm run test:e2e

build: test
	npm run build

# bits.featrix.com has no CI/CD for this bundle - it's just a file on a
# server, published by hand. This target IS the publish step; there is
# nothing else that will do it for you.
check-bits:
	@ssh -o BatchMode=yes -o ConnectTimeout=5 $(REMOTE_HOST) "echo ok" > /dev/null 2>&1 || \
		(echo "Cannot reach '$(REMOTE_HOST)' over SSH - check ~/.ssh/config has a Host $(REMOTE_HOST) entry." && exit 1)

publish: build test-e2e check-bits
	@echo "Backing up the current live bundle on $(REMOTE_HOST)..."
	ssh $(REMOTE_HOST) "mkdir -p $(REMOTE_PATH) && [ -f $(REMOTE_PATH)/modern-boxplot.standalone.js ] && cp $(REMOTE_PATH)/modern-boxplot.standalone.js $(REMOTE_PATH)/modern-boxplot.standalone.js.bak-$$(date +%Y%m%d%H%M%S) || true"
	@echo "Publishing $(BUNDLE) to $(REMOTE_HOST):$(REMOTE_PATH)..."
	rsync -avz --checksum $(BUNDLE) $(REMOTE_HOST):$(REMOTE_PATH)/modern-boxplot.standalone.js
	@echo "Published. Verify: curl -sI $(LIVE_URL)"
