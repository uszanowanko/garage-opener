# Convenience wrapper. Real config lives in firmware/include/config.h (gitignored).

FW := firmware
PORT ?=

.PHONY: help topics invite build flash monitor test-open test-lan clean

help:
	@echo "topics     - generate the two random ntfy topics"
	@echo "invite     - one person's key + roster line + setup link   (NAME=\"Mama\")"
	@echo "build      - compile firmware"
	@echo "flash      - compile + upload over USB   (PORT=/dev/ttyUSB0 to force)"
	@echo "monitor    - serial console at 115200"
	@echo "test-open  - send a signed open via ntfy   (NAME=.. KEY=..)"
	@echo "test-lan   - send a signed open to http://<name>.local/open"

topics:
	@echo "CMD_TOPIC = gate-$$(openssl rand -hex 24)"
	@echo "LOG_TOPIC = gate-$$(openssl rand -hex 24)"

invite:
	@node $(FW)/tools/invite.mjs $(if $(NAME),--name "$(NAME)",)

build:
	pio run -d $(FW)

flash:
	pio run -d $(FW) -t upload $(if $(PORT),--upload-port $(PORT),)

monitor:
	pio device monitor -d $(FW) -b 115200 $(if $(PORT),-p $(PORT),)

test-open:
	@node $(FW)/tools/send-open.mjs --name "$(NAME)" --key "$(KEY)"

test-lan:
	@node $(FW)/tools/send-open.mjs --name "$(NAME)" --key "$(KEY)" --lan

clean:
	pio run -d $(FW) -t clean
