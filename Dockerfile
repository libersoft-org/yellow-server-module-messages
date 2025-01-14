FROM oven/bun:latest

ARG UID=1000
ARG GID=1000

#RUN groupadd -g $GID usergroup && \
#    useradd -u $UID -g $GID -m user

# Install curl and tini
RUN apt update && apt install -y curl tini

# Use tini as the init system
ENTRYPOINT ["/usr/bin/tini", "--"]

ARG APP_DIR=/app/app/src/
RUN mkdir -p $APP_DIR
RUN chown $UID:$GID $APP_DIR
USER $UID:$GID
WORKDIR $APP_DIR

CMD ["./start-docker-dev.sh"]
