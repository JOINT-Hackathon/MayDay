package com.team5.MayDay.experience;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.*;
import java.util.*;
public interface ExperienceRepository extends JpaRepository<Experience,Long> {
    List<Experience> findTop3ByOwnerIdOrderByCreatedAtDescIdDesc(Long ownerId);
    Page<Experience> findByOwnerIdOrderByCreatedAtDescIdDesc(Long ownerId,Pageable pageable);
    Optional<Experience> findByIdAndOwnerId(Long id,Long ownerId);
}
