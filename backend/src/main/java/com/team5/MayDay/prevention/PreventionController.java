package com.team5.MayDay.prevention;
import com.team5.MayDay.prevention.dto.*;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import java.util.*;
@RestController
public class PreventionController {
    private final PreventionService service;
    public PreventionController(PreventionService service) { this.service=service; }
    @PostMapping("/api/experiences/{id}/preventions") @ResponseStatus(HttpStatus.CREATED) public PreventionResponse save(@PathVariable Long id,@Valid @RequestBody PreventionRequest input) { return service.save(id,input); }
    @GetMapping("/api/experiences/{id}/preventions") public List<PreventionResponse> all(@PathVariable Long id) { return service.findByExperienceId(id); }
    @GetMapping("/api/preventions") public List<PreventionResponse> category(@RequestParam String category) { return service.findByCategory(category); }
    @PutMapping("/api/preventions/{id}") public PreventionResponse update(@PathVariable Long id,@Valid @RequestBody PreventionRequest input) { return service.update(id,input); }
    @DeleteMapping("/api/preventions/{id}") public Map<String,Boolean> delete(@PathVariable Long id) { service.delete(id); return Map.of("ok",true); }
}
