package com.team5.MayDay.checklist;
import com.team5.MayDay.checklist.dto.*;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import java.util.*;
@RestController
public class ChecklistController {
    private final ChecklistService service;
    public ChecklistController(ChecklistService service) { this.service=service; }
    @PostMapping("/api/experiences/{id}/checklist") @ResponseStatus(HttpStatus.CREATED) public ChecklistResponse create(@PathVariable Long id,@Valid @RequestBody ChecklistCreateRequest input) { return service.create(id,input); }
    @GetMapping("/api/experiences/{id}/checklist") public List<ChecklistResponse> all(@PathVariable Long id) { return service.findByExperienceId(id); }
    @PatchMapping("/api/checklist/{id}/status") public ChecklistResponse status(@PathVariable Long id,@RequestBody ChecklistStatusRequest input) { return service.changeStatus(id,input); }
    @PutMapping("/api/checklist/{id}") public ChecklistResponse update(@PathVariable Long id,@Valid @RequestBody ChecklistCreateRequest input) { return service.update(id,input); }
    @DeleteMapping("/api/checklist/{id}") public Map<String,Boolean> delete(@PathVariable Long id) { service.delete(id); return Map.of("ok",true); }
    public record Order(List<Long> ids) {}
    @PutMapping("/api/experiences/{id}/checklist/order") public List<ChecklistResponse> order(@PathVariable Long id,@RequestBody Order input) { return service.reorder(id,input.ids()); }
}
