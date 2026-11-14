package com.team5.MayDay.prevention;
import com.team5.MayDay.prevention.dto.*;
import com.team5.MayDay.experience.ExperienceService;
import com.team5.MayDay.auth.CurrentUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
@Service
public class PreventionService {
    private final PreventionRepository repository;
    private final ExperienceService experiences;
    private final CurrentUser current;
    public PreventionService(PreventionRepository repository,ExperienceService experiences,CurrentUser current) { this.repository=repository; this.experiences=experiences; this.current=current; }
    private PreventionRule owned(Long id) { var value=repository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND)); experiences.owned(value.getExperienceId()); return value; }
    @Transactional public PreventionResponse save(Long id,PreventionRequest input) { experiences.owned(id); return response(repository.save(new PreventionRule(id,input.category().trim(),input.content().trim(),input.triggerPoint().trim()))); }
    @Transactional(readOnly=true) public List<PreventionResponse> findByCategory(String category) { if(category==null || category.isBlank() || category.length()>255) throw new IllegalArgumentException(); return repository.findOwnedCategory(current.id(),category.trim()).stream().map(this::response).toList(); }
    @Transactional(readOnly=true) public List<PreventionResponse> findByExperienceId(Long id) { experiences.owned(id); return repository.findByExperienceId(id).stream().map(this::response).toList(); }
    @Transactional public PreventionResponse update(Long id,PreventionRequest input) { var value=owned(id); value.update(input.category().trim(),input.content().trim(),input.triggerPoint().trim()); return response(value); }
    @Transactional public void delete(Long id) { repository.delete(owned(id)); }
    private PreventionResponse response(PreventionRule value) { return new PreventionResponse(value.getId(),value.getExperienceId(),value.getCategory(),value.getContent(),value.getTriggerPoint(),value.getCreatedAt()); }
}
