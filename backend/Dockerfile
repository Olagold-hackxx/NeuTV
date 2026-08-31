# The NEU TV gateway.
#
# One process serving the whole contract. It stays a process rather than a
# function because two things here need a lifetime and a disk: the live event
# stream is a held-open SSE connection, and a browser broadcast arrives as
# segments written to /data.
#
# Multi-stage only to keep npm's cache and the lockfile out of the final image;
# there is nothing to compile - the backend has one dependency and no build step.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# --omit=dev: the only dependency is pg, and the test runner is node's own.
RUN npm ci --omit=dev


FROM node:22-alpine AS runtime
WORKDIR /app

# tini reaps zombies and forwards signals, so SIGTERM reaches node and the
# shutdown handler closes the database pools instead of being killed at 10s.
RUN apk add --no-cache tini

ENV NODE_ENV=production \
    PORT=4173 \
    # Uploaded video lives in Cloudinary or a bucket; live segments are the one
    # thing that has to be on disk, and this is the volume they go to.
    NEUTV_DATA_DIR=/data

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=node:node . .

# node:alpine ships a "node" user. Running as root inside a container that
# accepts uploads is a needless amount of trust.
RUN mkdir -p /data && chown -R node:node /data /app
USER node

VOLUME ["/data"]
EXPOSE 4173

# Compose gates the frontend and the CDN on this, so it has to mean "serving",
# not "the process exists". /health touches the catalog and reports the
# contract version.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4173)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--no-warnings=ExperimentalWarning", "services/gateway/server.mjs"]
