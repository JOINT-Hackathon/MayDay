package com.team5.MayDay.checklist;
import com.team5.MayDay.checklist.dto.*;
import com.team5.MayDay.experience.ExperienceService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
@Service
public class ChecklistService {
    private final ChecklistRepository repository;
    private final ExperienceService experiences;
    public ChecklistService(ChecklistRepository repository,ExperienceService experiences) { this.repository=repository; this.experiences=experiences; }
    private ChecklistItem owned(Long id) { var value=repository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND)); experiences.owned(value.getExperienceId()); return value; }
    @Transactional public ChecklistResponse create(Long id,ChecklistCreateRequest input) { experiences.owned(id); return response(repository.save(new ChecklistItem(id,input.content().trim(),input.sortOrder()))); }
    @Transactional(readOnly=true) public List<ChecklistResponse> findByExperienceId(Long id) { experiences.owned(id); return repository.findByExperienceIdOrderBySortOrderAscIdAsc(id).stream().map(this::response).toList(); }
    @Transactional public ChecklistResponse changeStatus(Long id,ChecklistStatusRequest input) { if(input.status()==null) throw new IllegalArgumentException(); var value=owned(id); value.changeStatus(input.status()); return response(value); }
    @Transactional public ChecklistResponse update(Long id,ChecklistCreateRequest input) { var value=owned(id); value.update(input.content().trim(),input.sortOrder()); return response(value); }
    @Transactional public void delete(Long id) { repository.delete(owned(id)); }
    @Transactional public List<ChecklistResponse> reorder(Long id,List<Long> ids) {
        experiences.owned(id);
        var items=repository.findByExperienceIdOrderBySortOrderAscIdAsc(id);
        if(ids==null || ids.size()!=items.size() || new HashSet<>(ids).size()!=ids.size() || !new HashSet<>(ids).equals(new HashSet<>(items.stream().map(ChecklistItem::getId).toList()))) throw new IllegalArgumentException();
        var byId=new HashMap<Long,ChecklistItem>(); items.forEach(item -> byId.put(item.getId(),item));
        for(int index=0; index<ids.size();index++) { var item=byId.get(ids.get(index)); item.update(item.getContent(),index); }
        return ids.stream().map(byId::get).map(this::response).toList();
    }
    private ChecklistResponse response(ChecklistItem item) { return new ChecklistResponse(item.getId(),item.getExperienceId(),item.getContent(),item.getSortOrder(),item.getStatus(),item.getUpdatedAt()); }
}
