package com.atlassian.plugins.guile.rest;

import javax.xml.bind.annotation.*;
@XmlRootElement(name = "result")
@XmlAccessorType(XmlAccessType.FIELD)
public class GetSprintsModel {

    @XmlElement(name = "sprints")
    private SprintModel[] sprints;
    public SprintModel[] getSprints() { return sprints; }
    public void setSprints(SprintModel[] value) { sprints = value; }

    public GetSprintsModel() {
    }

    public GetSprintsModel(SprintModel[] sprints) {
        this.sprints = sprints;
    }

}
