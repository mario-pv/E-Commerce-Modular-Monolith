package com.portfolio.modulith.inventory;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/products")
@CrossOrigin(origins = "*")
public class ProductController {

    private final InventoryService inventoryService;

    public ProductController(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    public record ProductDetails(
            String id,
            String name,
            String category,
            double price,
            double originalPrice,
            int stock,
            boolean isFlashDeal,
            String tag,
            String description,
            String image,
            List<String> specs,
            double rating,
            int reviewCount
    ) {}

    private static final List<ProductDetails> CATALOG_DEFINITIONS = List.of(
            new ProductDetails(
                    "FLASH_ITEM",
                    "Quantum RTX Titan 5090 (24GB GDDR7)",
                    "Flagship GPUs",
                    1999.00,
                    2499.00,
                    10,
                    true,
                    "⚡ FLASH DEAL - 20% OFF",
                    "The ultimate high-concurrency flagship GPU with next-gen tensor accelerators and 32,000 CUDA cores. Hardware target of our pessimistic write-lock flash sale test.",
                    "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=800&q=80",
                    List.of("Blackwell Architecture", "24GB GDDR7 VRAM", "32,000 CUDA Cores", "DLSS 4.0 Neural Render"),
                    4.9,
                    482
            ),
            new ProductDetails(
                    "MECH_KEYBOARD",
                    "CyberForge Pro 75% Magnetic Switch Keyboard",
                    "Peripherals",
                    189.00,
                    229.00,
                    25,
                    false,
                    "🔥 Best Seller",
                    "Magnetic hall-effect switches with 0.1mm - 4.0mm adjustable rapid trigger actuation and anodized CNC aluminum chassis.",
                    "https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=800&q=80",
                    List.of("Hall-Effect Magnetic Switches", "8000Hz Hyper-Polling", "Anodized Aluminum Body", "RGB Per-Key"),
                    4.8,
                    315
            ),
            new ProductDetails(
                    "OLED_DISPLAY",
                    "AeroView 34\" Curved QD-OLED UltraWide",
                    "Displays",
                    849.00,
                    999.00,
                    8,
                    true,
                    "⚡ Flash Deal",
                    "Next-generation Quantum Dot OLED panel with pure infinite blacks, 240Hz refresh rate, and near-instant 0.03ms response time.",
                    "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80",
                    List.of("3440 x 1440 UWQHD", "240Hz Refresh Rate", "0.03ms GtG Response", "Quantum Dot OLED"),
                    4.9,
                    198
            ),
            new ProductDetails(
                    "AUDIO_PRO",
                    "SonicStream Studio Pro Wireless ANC",
                    "Audio",
                    299.00,
                    349.00,
                    15,
                    false,
                    "Hi-Res Audio",
                    "Reference-grade planar magnetic planar drivers with hybrid Active Noise Cancellation, LDAC lossless codec, and 45h battery.",
                    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80",
                    List.of("Planar Magnetic Drivers", "Hybrid Dual-Mic ANC", "Lossless LDAC Codec", "45-Hour Battery Life"),
                    4.7,
                    240
            ),
            new ProductDetails(
                    "SMART_HUB",
                    "Nexus Monolith AI Edge Gateway",
                    "Smart Tech",
                    149.00,
                    179.00,
                    20,
                    false,
                    "Zero-Cloud Privacy",
                    "Private local AI orchestration hub with multi-protocol Zigbee 3.0, Thread, and Matter support with on-device NPU.",
                    "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=800&q=80",
                    List.of("On-Device Local NPU", "Thread & Matter Native", "Hardware Encrypted", "Zero Cloud Reliance"),
                    4.6,
                    142
            ),
            new ProductDetails(
                    "MOUSE_TITAN",
                    "ViperStrike 8K Ultralight Wireless Mouse",
                    "Peripherals",
                    129.00,
                    149.00,
                    30,
                    false,
                    "Ultralight 36g",
                    "Magnesium skeleton shell weighing only 36 grams, optical Gen-3 switches, and true 8000Hz polling rate for esports competitors.",
                    "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80",
                    List.of("36g Magnesium Shell", "Focus Pro 30K Sensor", "8000Hz Wireless Polling", "Gen-3 Optical Switches"),
                    4.8,
                    289
            )
    );

    @GetMapping
    public ResponseEntity<List<ProductDetails>> getAllProducts() {
        // Product details are hard-coded; only the quantities come from inventory.
        Map<String, Integer> stockMap = inventoryService.getAllStock().stream()
                .collect(Collectors.toMap(StockView::productCode, StockView::quantity, (a, b) -> a));

        List<ProductDetails> products = CATALOG_DEFINITIONS.stream()
                .map(p -> {
                    int liveStock = stockMap.getOrDefault(p.id(), p.stock());
                    return new ProductDetails(
                            p.id(), p.name(), p.category(), p.price(), p.originalPrice(),
                            liveStock, p.isFlashDeal(), p.tag(), p.description(),
                            p.image(), p.specs(), p.rating(), p.reviewCount()
                    );
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(products);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProductDetails> getProductById(@PathVariable String id) {
        return CATALOG_DEFINITIONS.stream()
                .filter(p -> p.id().equalsIgnoreCase(id))
                .findFirst()
                .map(p -> {
                    int liveStock = inventoryService.getStock(p.id())
                            .map(StockView::quantity)
                            .orElse(p.stock());
                    return ResponseEntity.ok(new ProductDetails(
                            p.id(), p.name(), p.category(), p.price(), p.originalPrice(),
                            liveStock, p.isFlashDeal(), p.tag(), p.description(),
                            p.image(), p.specs(), p.rating(), p.reviewCount()
                    ));
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
