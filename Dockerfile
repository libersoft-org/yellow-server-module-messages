FROM oven/bun:latest

# Install curl and tini
RUN apt update && apt install -y curl tini

# Use tini as the init system
ENTRYPOINT ["/usr/bin/tini", "--"]

USER 1000:1000
WORKDIR /app/app/src/

CMD ["./start-docker-dev.sh"]
