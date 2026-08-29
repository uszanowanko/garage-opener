# Convenience wrapper. Real config lives in firmware/include/config.h (gitignored).

FW := firmware
PORT ?=

.PHONY: help topics enroll build flash monitor test-open test-lan clean

help:
	@echo "topics     - generate the two random ntfy topics"
	@echo "enroll     - keyword -> roster line for config.h"
	@echo "build      - compile firmware"
	@echo "flash      - compile + upload over USB   (PORT=/dev/ttyUSB0 to force)"
	@echo "monitor    - serial console at 115200"
	@echo "test-open  - send a signed open via ntfy   (NAME=.. KEYWORD=..)"
	@echo "test-lan   - send a signed open to http://garage.local/open"

topics:
	@echo "CMD_TOPIC = garage-$$(openssl rand -hex 24)"
	@echo "LOG_TOPIC = garage-$$(openssl rand -hex 24)"

enroll:
	@node $(FW)/tools/enroll.mjs

build:
	pio run -d $(FW)

flash:
	pio run -d $(FW) -t upload $(if $(PORT),--upload-port $(PORT),)

monitor:
	pio device monitor -d $(FW) -b 115200 $(if $(PORT),-p $(PORT),)

test-open:
	@node $(FW)/tools/send-open.mjs --name "$(NAME)" --keyword "$(KEYWORD)"

test-lan:
	@node $(FW)/tools/send-open.mjs --name "$(NAME)" --keyword "$(KEYWORD)" --lan

clean:
	pio run -d $(FW) -t clean
