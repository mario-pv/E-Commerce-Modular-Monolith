package com.portfolio.modulith.notification;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
@CrossOrigin(origins = "*")
public class NotificationController {

    private final NotificationListener notificationListener;

    public NotificationController(NotificationListener notificationListener) {
        this.notificationListener = notificationListener;
    }

    @GetMapping
    public ResponseEntity<List<NotificationListener.NotificationRecord>> getNotifications() {
        return ResponseEntity.ok(notificationListener.getRecentNotifications());
    }
}
