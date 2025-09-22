# Stage 1: Build the React application
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Serve the application using Nginx
FROM nginx:1.21.4-alpine

# Install envsubst
RUN apk update && apk add gettext

# Copy custom nginx configuration template
COPY nginx.template.conf /etc/nginx/conf.d/default.template.conf

# Copy the startup script
COPY start.sh /
RUN chmod +x /start.sh

# Copy the build output from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 8080 - This is just for documentation, Cloud Run handles the actual port
EXPOSE 8080

# Start the app using the startup script
CMD ["/start.sh"]
