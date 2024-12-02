# Dockerfile

# Base image
FROM node:18

# Set working directory
WORKDIR /app

# Normally you'd install dependencies here, but for now we're just installing
# them manually
# COPY package*.json ./
# RUN npm install

# Copy app source code
COPY . .

# Build the app
RUN npm run build

# Expose the port the app runs on
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
