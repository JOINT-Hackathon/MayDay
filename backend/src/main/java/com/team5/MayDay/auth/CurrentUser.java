package com.team5.MayDay.auth;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
@Component
public class CurrentUser {
    private final HttpServletRequest request;
    public CurrentUser(HttpServletRequest request) { this.request=request; }
    public Long id() {
        Object value=request.getAttribute("accountId");
        if (!(value instanceof Long)) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"로그인이 필요합니다.");
        return (Long)value;
    }
}
