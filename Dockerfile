FROM node:24.12.0-slim

WORKDIR /app

RUN npm install --global npm@10.9.9
COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .
RUN npm run lint && npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
