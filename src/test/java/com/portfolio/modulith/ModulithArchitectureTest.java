package com.portfolio.modulith;

import jakarta.persistence.Entity;
import org.junit.jupiter.api.Test;
import org.springframework.data.repository.Repository;
import org.springframework.modulith.core.ApplicationModules;
import org.springframework.modulith.core.NamedInterface;
import org.springframework.modulith.docs.Documenter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertAll;

class ModulithArchitectureTest {

    private final ApplicationModules modules = ApplicationModules.of(ModulithApplication.class);

    @Test
    void verifyArchitecture() {
        // Structurally verifies that no circular dependencies or invalid cross-module accesses exist
        modules.verify();
    }

    @Test
    void inventoryPersistenceIsNotExposedAsModuleApi() {
        var inventory = modules.getModuleByName("inventory").orElseThrow();
        var stock = inventory.getType("Stock").orElseThrow();
        var repository = inventory.getType("StockRepository").orElseThrow();
        var exposedPersistence = inventory.getNamedInterfaces().stream()
                .flatMap(NamedInterface::asJavaClasses)
                .filter(type -> type.isAnnotatedWith(Entity.class) || type.isAssignableTo(Repository.class))
                .map(type -> type.getName())
                .toList();

        assertAll(
                () -> assertThat(inventory.isExposed(inventory.getType("InventoryService").orElseThrow()))
                        .as("InventoryService remains the public inventory API").isTrue(),
                () -> assertThat(inventory.isExposed(stock))
                        .as("Stock must not be exposed in Modulith's inventory API").isFalse(),
                () -> assertThat(inventory.isExposed(repository))
                        .as("StockRepository must not be exposed in Modulith's inventory API").isFalse(),
                () -> assertThat(exposedPersistence)
                        .as("No JPA entity or Spring Data repository belongs in the exposed inventory API").isEmpty());
    }

    @Test
    void createDocumentationDynamicDiagrams() {
        // Automatically generates C4 / PlantUML component diagrams into target/spring-modulith-docs
        new Documenter(modules).writeDocumentation();
    }
}
