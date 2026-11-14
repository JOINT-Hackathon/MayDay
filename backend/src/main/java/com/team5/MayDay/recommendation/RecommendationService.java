package com.team5.MayDay.recommendation;
import com.team5.MayDay.prevention.PreventionService;
import com.team5.MayDay.recommendation.dto.*;
import org.springframework.stereotype.Service;
@Service
public class RecommendationService {
    private final PreventionService prevention;
    public RecommendationService(PreventionService prevention) { this.prevention=prevention; }
    public RecommendationResponse recommend(RecommendationRequest input) {
        if(input.task()==null || input.task().isBlank() || input.task().length()>1000) throw new IllegalArgumentException();
        var items=prevention.findByCategory(input.category()).stream().limit(3).map(item -> new RecommendationResponse.RecommendedItem(item.id(),item.experienceId(),item.content(),item.triggerPoint())).toList();
        return new RecommendationResponse(input.task(),input.category(),items.isEmpty() ? "저장한 규칙이 없습니다." : "내가 저장한 같은 업무 분류의 최신 규칙입니다.",items);
    }
}
