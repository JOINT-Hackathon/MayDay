package com.team5.MayDay.auth;
import jakarta.persistence.*;
import java.time.Instant;
@Entity @Table(name="login_sessions")
public class LoginSession {
    @Id @Column(length=64) private String tokenHash;
    @Column(nullable=false) private Long accountId;
    @Column(nullable=false) private Instant expiresAt;
    protected LoginSession() {}
    public LoginSession(String tokenHash, Long accountId, Instant expiresAt) { this.tokenHash=tokenHash; this.accountId=accountId; this.expiresAt=expiresAt; }
    public Long getAccountId() { return accountId; }
    public Instant getExpiresAt() { return expiresAt; }
}
