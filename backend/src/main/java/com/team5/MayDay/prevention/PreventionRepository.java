package com.team5.MayDay.prevention;
import org.springframework.data.jpa.repository.*;
import java.util.List;
public interface PreventionRepository extends JpaRepository<PreventionRule,Long> {
    @Query("select p from PreventionRule p, Experience e where p.experienceId=e.id and e.ownerId=:ownerId and p.category=:category order by p.createdAt desc, p.id desc")
    List<PreventionRule> findOwnedCategory(Long ownerId,String category);
    List<PreventionRule> findByExperienceId(Long experienceId);
}
