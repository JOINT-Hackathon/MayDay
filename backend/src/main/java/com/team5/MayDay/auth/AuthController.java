package com.team5.MayDay.auth;
import jakarta.servlet.http.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
@RestController @RequestMapping("/api/auth")
public class AuthController {
    private final AuthService auth;
    private final CurrentUser current;
    private final boolean secure;
    public AuthController(AuthService auth,CurrentUser current,@Value("${app.cookie-secure:false}") boolean secure) { this.auth=auth; this.current=current; this.secure=secure; }
    public record Credentials(String username,String password) {}
    @PostMapping({"/login","/register"}) public AuthService.User login(@RequestBody Credentials body,HttpServletRequest request,HttpServletResponse response) {
        auth.limit(request.getRemoteAddr());
        var result=auth.login(body.username(),body.password(),request.getRequestURI().endsWith("/register"));
        auth.logout(AuthFilter.token(request));
        cookie(response,result.token(),604800);
        return result.user();
    }
    @GetMapping("/me") public AuthService.User me() { return auth.user(current.id()); }
    @PostMapping("/logout") public Map<String,Boolean> logout(HttpServletRequest request,HttpServletResponse response) { auth.logout(AuthFilter.token(request)); cookie(response,"",0); return Map.of("ok",true); }
    private void cookie(HttpServletResponse response,String value,long age) { response.addHeader("Set-Cookie",ResponseCookie.from(AuthFilter.COOKIE,value).httpOnly(true).secure(secure).sameSite("Strict").path("/").maxAge(age).build().toString()); }
}
