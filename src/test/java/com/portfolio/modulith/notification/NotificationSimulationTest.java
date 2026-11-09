package com.portfolio.modulith.notification;

import com.portfolio.modulith.order.OrderCreatedEvent;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class NotificationSimulationTest {
    @Test
    void reportsSimulationNotActualSmtpDelivery() throws InterruptedException {
        NotificationListener listener = new NotificationListener();
        listener.onOrderCreated(new OrderCreatedEvent("simulation-test", "FLASH_ITEM", 1));
        assertThat(listener.getRecentNotifications()).extracting(NotificationListener.NotificationRecord::status)
                .containsExactly("SIMULATED_DELIVERY", "RECEIVED_FROM_OUTBOX");
    }
}
