package com.atlassian.plugins.guile.rest;

import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement(name = "result")
@XmlAccessorType(XmlAccessType.FIELD)
public class GetSprintIssuesModel {

    @XmlElement(name = "issues")
    private IssueModel[] issues;
    public IssueModel[] getIssues() { return issues; }
    public void setIssues(IssueModel[] value) { issues = value; }

    public GetSprintIssuesModel() {
    }

    public GetSprintIssuesModel(IssueModel[] issues) {
        this.issues = issues;
    }

}
