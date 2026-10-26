# One image for Render: the Node server, which also serves the built Angular app.
# The server runs from TypeScript under tsx, as `npm run server` does.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build app

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    STATIC_DIR=/app/dist/app/browser
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/tsconfig.json ./
COPY --from=build /app/projects/engine ./projects/engine
COPY --from=build /app/projects/content ./projects/content
COPY --from=build /app/projects/bots ./projects/bots
COPY --from=build /app/projects/protocol ./projects/protocol
COPY --from=build /app/projects/server ./projects/server
COPY --from=build /app/dist/app/browser ./dist/app/browser
EXPOSE 8080
CMD ["npx", "tsx", "--tsconfig", "projects/server/tsconfig.json", "projects/server/src/main.ts"]
