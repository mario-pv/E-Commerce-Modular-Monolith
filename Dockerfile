# Build the same frontend that Spring Boot serves.
FROM node:22-bookworm-slim AS frontend-build
WORKDIR /workspace/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM maven:3.9-eclipse-temurin-21 AS backend-build
WORKDIR /workspace
COPY pom.xml ./
COPY src/ ./src/
COPY --from=frontend-build /workspace/src/main/resources/static/ ./src/main/resources/static/
# Run the full Docker-backed test suite on the host with mvn verify.
RUN mvn -B -DskipTests package

FROM eclipse-temurin:21-jre-jammy
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=backend-build --chown=10001:10001 /workspace/target/modulith-0.0.1-SNAPSHOT.jar ./app.jar
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
