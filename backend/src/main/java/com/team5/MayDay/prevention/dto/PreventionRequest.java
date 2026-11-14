package com.team5.MayDay.prevention.dto;
import jakarta.validation.constraints.*;
public record PreventionRequest(@NotBlank @Size(max=255) String category,@NotBlank @Size(max=1000) String content,@NotBlank @Size(max=255) String triggerPoint) {}
