package com.team5.MayDay.experience;
import com.team5.MayDay.auth.CurrentUser;
import com.team5.MayDay.experience.dto.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.data.domain.PageRequest;
import java.util.*;
@Service
public class ExperienceService {
    private final ExperienceRepository repository;
    private final CurrentUser current;
    public ExperienceService(ExperienceRepository repository,CurrentUser current) { this.repository=repository; this.current=current; }
    public Experience owned(Long id) { return repository.findByIdAndOwnerId(id,current.id()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,"기록을 찾을 수 없습니다.")); }
    public record ExperiencePage(List<ExperienceResponse> items,int page,int totalPages,long totalElements) {}
    @Transactional(readOnly=true) public ExperiencePage all(int page) {
        if(page<0 || page>100000) throw new IllegalArgumentException();
        var data=repository.findByOwnerIdOrderByCreatedAtDescIdDesc(current.id(),PageRequest.of(page,20));
        return new ExperiencePage(data.getContent().stream().map(this::response).toList(),page,data.getTotalPages(),data.getTotalElements());
    }
    @Transactional(readOnly=true) public ExperienceResponse get(Long id) { return response(owned(id)); }
    @Transactional public ExperienceResponse save(ExperienceRequest input) {
        var value=new Experience(input.type(),input.content().trim(),input.category().trim());
        value.setOwnerId(current.id()); value.update(input.type(),input.content().trim(),input.category().trim(),input.details());
        return response(repository.save(value));
    }
    @Transactional public ExperienceResponse update(Long id,ExperienceRequest input) { var value=owned(id); value.update(input.type(),input.content().trim(),input.category().trim(),input.details()); return response(value); }
    @Transactional public void delete(Long id) { repository.delete(owned(id)); repository.flush(); }
    @Transactional(readOnly=true) public List<RecentExperienceResponse> findRecent() {
        return repository.findTop3ByOwnerIdOrderByCreatedAtDescIdDesc(current.id()).stream().map(value -> new RecentExperienceResponse(value.getId(),value.getContent().length()>20 ? value.getContent().substring(0,20)+"…" : value.getContent(),"기록 저장됨",value.getCreatedAt())).toList();
    }
    private ExperienceResponse response(Experience value) { return new ExperienceResponse(value.getId(),value.getType(),value.getContent(),value.getCategory(),value.getCreatedAt(),value.getDetails()); }
}
