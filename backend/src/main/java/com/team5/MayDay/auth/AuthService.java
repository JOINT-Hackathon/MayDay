package com.team5.MayDay.auth;
import java.security.*;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
@Service
public class AuthService {
    private final AccountRepository accounts;
    private final SessionRepository sessions;
    private final String dummyHash=Passwords.hash("constant-time-dummy-password");
    private final Map<String,List<Instant>> attempts=new HashMap<>();
    public AuthService(AccountRepository accounts,SessionRepository sessions) { this.accounts=accounts; this.sessions=sessions; }
    public record User(Long id,String username) {}
    public record Login(User user,String token) {}
    public synchronized void limit(String address) {
        Instant cutoff=Instant.now().minusSeconds(300);
        attempts.values().forEach(list -> list.removeIf(t -> t.isBefore(cutoff)));
        attempts.entrySet().removeIf(entry -> entry.getValue().isEmpty());
        if (attempts.size()>=10000 && !attempts.containsKey(address)) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS);
        var list=attempts.computeIfAbsent(address,key -> new ArrayList<>());
        if (list.size()>=30) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"로그인 시도가 많습니다. 5분 후 다시 시도해 주세요.");
        list.add(Instant.now());
    }
    @Transactional
    public Login login(String name,String password,boolean register) {
        if (name==null || password==null || !name.matches("[A-Za-z0-9_]{3,40}") || password.length()<10 || password.length()>128)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"아이디는 영문·숫자·밑줄 3~40자, 비밀번호는 10~128자입니다.");
        name=name.toLowerCase(Locale.ROOT);
        Account account=accounts.findByUsername(name).orElse(null);
        if (register) {
            if (account!=null) throw new ResponseStatusException(HttpStatus.CONFLICT,"이미 사용 중인 아이디입니다.");
            account=accounts.saveAndFlush(new Account(name,Passwords.hash(password)));
        } else if (!Passwords.matches(password,account==null ? dummyHash : account.getPasswordHash()) || account==null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"아이디 또는 비밀번호를 확인해 주세요.");
        }
        sessions.deleteByExpiresAtBefore(Instant.now());
        byte[] bytes=new byte[32]; new SecureRandom().nextBytes(bytes);
        String token=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        sessions.save(new LoginSession(digest(token),account.getId(),Instant.now().plus(Duration.ofDays(7))));
        return new Login(new User(account.getId(),account.getUsername()),token);
    }
    public Long authenticate(String token) {
        if (token==null || !token.matches("[A-Za-z0-9_-]{43}")) return null;
        return sessions.findById(digest(token)).filter(session -> session.getExpiresAt().isAfter(Instant.now())).map(LoginSession::getAccountId).orElse(null);
    }
    public User user(Long id) { var account=accounts.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED)); return new User(account.getId(),account.getUsername()); }
    @Transactional public void logout(String token) { if(token!=null) sessions.deleteById(digest(token)); }
    private static String digest(String token) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(java.nio.charset.StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException error) { throw new IllegalStateException(error); }
    }
}
