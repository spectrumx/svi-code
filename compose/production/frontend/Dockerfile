# Step 1: Build the React application
FROM node:18 AS build

# Set working directory
WORKDIR /app

# Normally you'd install dependencies here, but for now we're just installing
# them manually
# COPY package.json package-lock.json ./
# RUN npm install --production

# Copy source code and build the app
COPY . .
RUN npm install
RUN npm run build

# Step 2: Serve the application with Nginx
FROM nginx:1.17.8-alpine

# Copy Nginx configuration file (optional, only needed for custom config)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build output to Nginx HTML folder
COPY --from=build /app/build /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Add a startup script
COPY docker-entrypoint.sh /
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
