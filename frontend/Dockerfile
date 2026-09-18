# syntax=docker/dockerfile:1

# ---------- Stage 1: build the React app ----------
# This stage needs Node, npm and ~200MB of packages. None of that ships to the
# server: it exists only to turn TypeScript and JSX into plain files.
FROM node:24-alpine AS build

WORKDIR /app

# Same caching trick as the Python image: lockfile first, then source.
# "npm ci" installs the exact versions in package-lock.json - repeatable builds.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------- Stage 2: the image that actually runs ----------
# Only the finished /dist folder is carried over, so the finished image is a few MB
# of nginx plus your HTML, CSS and JavaScript. This is a "multi-stage build".
FROM nginx:1.29-alpine

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
