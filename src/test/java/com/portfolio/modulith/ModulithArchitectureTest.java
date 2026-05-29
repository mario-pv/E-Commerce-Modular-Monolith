package com.portfolio.modulith;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;
import org.springframework.modulith.docs.Documenter;

class ModulithArchitectureTest {

    private final ApplicationModules modules = ApplicationModules.of(ModulithApplication.class);

    @Test
    void verifyArchitecture() {
        // Structurally verifies that no circular dependencies or invalid cross-module accesses exist
        modules.verify();
    }

    @Test
    void createDocumentationDynamicDiagrams() {
        // Automatically generates C4 / PlantUML component diagrams into target/spring-modulith-docs
        new Documenter(modules).writeDocumentation();
    }
}
