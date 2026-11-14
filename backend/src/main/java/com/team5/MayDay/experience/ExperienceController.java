package com.team5.MayDay.experience;
import com.team5.MayDay.experience.dto.*;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import java.util.*;
@RestController @RequestMapping("/api/experiences")
public class ExperienceController {
    private final ExperienceService service;
    public ExperienceController(ExperienceService service) { this.service=service; }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public ExperienceResponse create(@Valid @RequestBody ExperienceRequest input) { return service.save(input); }
    @GetMapping public ExperienceService.ExperiencePage all(@RequestParam(defaultValue="0") int page) { return service.all(page); }
    @GetMapping("/recent") public List<RecentExperienceResponse> recent() { return service.findRecent(); }
    @GetMapping("/{id}") public ExperienceResponse get(@PathVariable Long id) { return service.get(id); }
    @PutMapping("/{id}") public ExperienceResponse update(@PathVariable Long id,@Valid @RequestBody ExperienceRequest input) { return service.update(id,input); }
    @DeleteMapping("/{id}") public Map<String,Boolean> delete(@PathVariable Long id) { service.delete(id); return Map.of("ok",true); }
}
