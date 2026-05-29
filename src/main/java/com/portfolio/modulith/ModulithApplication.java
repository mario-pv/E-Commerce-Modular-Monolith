package com.portfolio.modulith;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@EnableAsync
@SpringBootApplication
public class ModulithApplication {

    public static void main(String[] args) {
        SpringApplication.run(ModulithApplication.class, args);
    }

}
