package com.team5.MayDay.experience.dto;
import jakarta.validation.constraints.*;
public record ExperienceRequest(@NotBlank @Pattern(regexp="mistake|feedback") String type,
    @NotBlank @Size(max=3000) String content,@NotBlank @Size(max=255) String category,
    @Size(max=20000) String details) {}
