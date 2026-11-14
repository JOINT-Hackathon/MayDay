package com.team5.MayDay.checklist.dto;
import jakarta.validation.constraints.*;
public record ChecklistCreateRequest(@NotBlank @Size(max=1000) String content,@Min(0) @Max(1000000) int sortOrder) {}
