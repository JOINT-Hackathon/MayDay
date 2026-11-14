package com.team5.MayDay.common;
import java.util.Map;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
@RestControllerAdvice
public class ApiErrors {
    @ExceptionHandler(ResponseStatusException.class) public ResponseEntity<?> status(ResponseStatusException error) { return ResponseEntity.status(error.getStatusCode()).body(Map.of("error",error.getReason()==null ? "요청을 처리하지 못했습니다." : error.getReason())); }
    @ExceptionHandler({IllegalArgumentException.class,MethodArgumentNotValidException.class,HttpMessageNotReadableException.class}) public ResponseEntity<?> invalid(Exception error) { return ResponseEntity.badRequest().body(Map.of("error","입력 내용과 길이를 확인해 주세요.")); }
    @ExceptionHandler(DataIntegrityViolationException.class) public ResponseEntity<?> conflict(Exception error) { return ResponseEntity.status(409).body(Map.of("error","이미 저장되었거나 다른 변경과 충돌했습니다. 새로고침해 주세요.")); }
}
