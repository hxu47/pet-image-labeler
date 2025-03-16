# Stage 1: Build with node alpine
FROM node:18-alpine as build

WORKDIR /app

# Increase Node.js memory allocation
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Copy package files and install dependencies with production flag
COPY package*.json ./
RUN npm ci 

# Copy only necessary files
COPY public ./public
COPY src ./src

# Build the app
RUN npm run build

# Stage 2: Serve with nginx alpine
FROM nginx:alpine

# Copy built app from previous stage
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]