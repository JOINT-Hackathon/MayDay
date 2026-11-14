package com.team5.MayDay.auth;
import jakarta.persistence.*;
@Entity @Table(name="app_users")
public class Account {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(nullable=false, unique=true, length=40) private String username;
    @Column(nullable=false, length=200) private String passwordHash;
    protected Account() {}
    public Account(String username, String passwordHash) { this.username=username; this.passwordHash=passwordHash; }
    public Long getId() { return id; }
    public String getUsername() { return username; }
    public String getPasswordHash() { return passwordHash; }
}
