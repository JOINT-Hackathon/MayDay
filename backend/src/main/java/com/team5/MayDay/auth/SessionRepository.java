package com.team5.MayDay.auth;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.Instant;
public interface SessionRepository extends JpaRepository<LoginSession,String> {
    void deleteByExpiresAtBefore(Instant time);
}
