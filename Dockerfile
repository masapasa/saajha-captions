# Pin both the patch version and the registry manifest.
FROM caddy:2.11.7-alpine@sha256:e70b164da81ef698b3ad19af799ea6086ce6d9e48ed4079eb9fe26f6fbf14ee5
# The official binary has a low-port file capability. This server only uses 8080;
# removing it permits non-root execution with ALL capabilities dropped.
RUN setcap -r /usr/bin/caddy
USER 1000:1000
